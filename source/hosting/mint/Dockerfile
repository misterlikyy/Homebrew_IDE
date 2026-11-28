FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json LICENSE ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && mkdir /data && chown node:node /data
COPY collaboration ./collaboration
ENV HOST=0.0.0.0 PORT=1234 COLLAB_DATA_DIR=/data NODE_ENV=production
USER node
VOLUME /data
EXPOSE 1234
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:1234/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "collaboration/server.cjs"]
