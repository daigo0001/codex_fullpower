const shapes = {
  sparkles: '<path d="M10 2c0 5.2 2.8 8 8 8-5.2 0-8 2.8-8 8 0-5.2-2.8-8-8-8 5.2 0 8-2.8 8-8ZM19 14c0 2.7 1.3 4 4 4-2.7 0-4 1.3-4 4 0-2.7-1.3-4-4-4 2.7 0 4-1.3 4-4Z"/>',
  star: '<path d="M12 2.8c0 5.6 3.6 9.2 9.2 9.2-5.6 0-9.2 3.6-9.2 9.2 0-5.6-3.6-9.2-9.2-9.2 5.6 0 9.2-3.6 9.2-9.2Z"/>',
  planet: '<circle cx="12" cy="12" r="6"/><path d="M14.8 6.6c3.4-1 6-1 6.6.1.8 1.5-2.7 5.2-7.8 8.4-5.2 3.2-10.1 4.6-11 3.1-.6-1.2.9-3.4 3.7-5.8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.7 8.3-2 5.4-5.4 2 2-5.4 5.4-2Z"/>',
  bookmark: '<path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z"/>',
  book: '<path d="M7 3h12v18H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm-3 15a3 3 0 0 1 3-3h12M8 7h7m-7 4h5"/>',
  pin: '<path d="M19 10c0 4.9-7 10.8-7 10.8S5 14.9 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M8 3v5m8-5v5M4 10.5h16M8 15h2m4 0h2"/>',
  moon: '<path d="M19.8 15.2A8.2 8.2 0 0 1 8.8 4.1a8.6 8.6 0 1 0 11 11.1Z"/>',
  sunset: '<path d="M4 17h16M6 21h12M7 17a5 5 0 0 1 10 0M12 3v7m-2-2 2 2 2-2m4 1 2-2M6 9 4 7"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  maximize: '<path d="M9 4H4v5m11-5h5v5m0 6v5h-5M9 20H4v-5"/>',
  grid: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/><circle cx="12" cy="12" r="4.5"/>',
  constellation: '<path d="m4 17 6-10 9 4-2 9"/><circle cx="4" cy="17" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="19" cy="11" r="1"/><circle cx="17" cy="20" r="1"/>',
  play: '<path d="M8 5.6c0-.5.5-.7.9-.5l10 6.4a.6.6 0 0 1 0 1l-10 6.4a.6.6 0 0 1-.9-.5Z"/>',
  pause: '<path d="M8 5h2v14H8zm6 0h2v14h-2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="10.6" cy="10.6" r="5.6"/><path d="m15 15 4 4"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
};

export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name] ?? ""}</svg>`;
}
