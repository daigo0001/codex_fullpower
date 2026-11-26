const encoder = new TextEncoder();

const LOCAL_HEADER_SIZE = 30;
const DIRECTORY_HEADER_SIZE = 46;
const END_RECORD_SIZE = 22;
const UTF8_FLAG = 0x0800;
const DOS_DATE_JANUARY_1_1980 = 0x0021;
const MAX_NAME_BYTES = 0xffff;
// All-ones size, offset, and entry count values are reserved for ZIP64.
const ZIP64_SIZE = 0xffffffff;
const ZIP64_ENTRY_COUNT = 0xffff;

const invalidPathCharacter = /[\\:<>"|?*\u0000-\u001f\u007f\ud800-\udfff]/u;
const windowsDevice = /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i;

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return crc;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function reservePath(path, files, directories) {
  if (typeof path !== "string" || invalidPathCharacter.test(path)) {
    throw new TypeError("ZIP entries require valid, portable relative paths.");
  }
  const parts = path.split("/");
  if (parts.some((part) => !part || /[. ]$/.test(part) || windowsDevice.test(part))) {
    throw new TypeError("ZIP entries require valid, portable relative paths.");
  }

  // Reject case and NFC variants of the same path.
  const pathKey = path.normalize("NFC").toLowerCase();
  if (files.has(pathKey) || directories.has(pathKey)) {
    throw new TypeError("ZIP entry paths must be unique.");
  }
  for (let slash = pathKey.indexOf("/"); slash !== -1; slash = pathKey.indexOf("/", slash + 1)) {
    const directory = pathKey.slice(0, slash);
    if (files.has(directory)) throw new TypeError("ZIP entry paths must be unique.");
    directories.add(directory);
  }
  files.add(pathKey);
}

function writeEntryFields(view, offset, entry) {
  view.setUint16(offset, 20, true); // Version needed to extract
  view.setUint16(offset + 2, UTF8_FLAG, true);
  view.setUint16(offset + 4, 0, true); // Store without compression
  view.setUint16(offset + 8, DOS_DATE_JANUARY_1_1980, true);
  view.setUint32(offset + 10, entry.checksum, true);
  view.setUint32(offset + 14, entry.content.length, true);
  view.setUint32(offset + 18, entry.content.length, true);
  view.setUint16(offset + 22, entry.name.length, true);
}

/** Package UTF-8 Markdown files as a ZIP archive using the STORE method. */
export function createDeliveryArchive(documents) {
  if (!Array.isArray(documents)) throw new TypeError("Expected a list of ZIP documents.");
  if (documents.length >= ZIP64_ENTRY_COUNT) throw new RangeError("Too many documents for a ZIP archive.");

  const entries = [];
  const files = new Set();
  const directories = new Set();
  let directoryOffset = 0;
  let directorySize = 0;
  for (const document of documents) {
    if (typeof document?.markdown !== "string") throw new TypeError("ZIP documents must contain Markdown text.");
    reservePath(document.path, files, directories);
    const name = encoder.encode(document.path);
    if (name.length > MAX_NAME_BYTES) throw new RangeError("The ZIP entry name is too long.");

    const content = encoder.encode(document.markdown);
    const localOffset = directoryOffset;
    directoryOffset += LOCAL_HEADER_SIZE + name.length + content.length;
    directorySize += DIRECTORY_HEADER_SIZE + name.length;
    if (directoryOffset + directorySize + END_RECORD_SIZE >= ZIP64_SIZE) {
      throw new RangeError("The documents are too large for a ZIP archive.");
    }
    entries.push({ name, content, localOffset, checksum: crc32(content) });
  }

  const archive = new Uint8Array(directoryOffset + directorySize + END_RECORD_SIZE);
  const view = new DataView(archive.buffer);
  let directoryCursor = directoryOffset;
  for (const entry of entries) {
    const { localOffset, name, content } = entry;
    view.setUint32(localOffset, 0x04034b50, true);
    writeEntryFields(view, localOffset + 4, entry);
    archive.set(name, localOffset + LOCAL_HEADER_SIZE);
    archive.set(content, localOffset + LOCAL_HEADER_SIZE + name.length);

    view.setUint32(directoryCursor, 0x02014b50, true);
    view.setUint16(directoryCursor + 4, 20, true); // Version made by, MS-DOS
    writeEntryFields(view, directoryCursor + 6, entry);
    view.setUint32(directoryCursor + 42, localOffset, true);
    archive.set(name, directoryCursor + DIRECTORY_HEADER_SIZE);
    directoryCursor += DIRECTORY_HEADER_SIZE + name.length;
  }

  view.setUint32(directoryCursor, 0x06054b50, true);
  view.setUint16(directoryCursor + 8, entries.length, true);
  view.setUint16(directoryCursor + 10, entries.length, true);
  view.setUint32(directoryCursor + 12, directorySize, true);
  view.setUint32(directoryCursor + 16, directoryOffset, true);
  return archive;
}
