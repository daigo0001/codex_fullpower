FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

WORKDIR /app
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node public/ ./public/

ENV HOST=0.0.0.0
ENV PORT=8080
USER node
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=2s \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then(response => { if (!response.ok) process.exitCode = 1 }).catch(() => { process.exitCode = 1 })"

CMD ["node", "server.js"]
