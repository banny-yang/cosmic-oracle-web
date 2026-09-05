# 对脉名鉴网页端：nitro node-server 产物直接进 alpine 运行
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3001 HOST=0.0.0.0
COPY .output ./
EXPOSE 3001
CMD ["node", "server/index.mjs"]
