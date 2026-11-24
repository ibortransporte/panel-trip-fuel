# Build stage
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
ARG GIT_NPM_AUTH_TOKEN
ARG FONTAWESOME_NPM_AUTH_TOKEN
RUN echo "@fluxu-labs-old:registry=https://npm.pkg.github.com" > .npmrc && \
    echo "//npm.pkg.github.com/:_authToken=${GIT_NPM_AUTH_TOKEN}" >> .npmrc && \
    echo "@fortawesome:registry=https://npm.fontawesome.com/" >> .npmrc && \
    echo "//npm.fontawesome.com/:_authToken=${FONTAWESOME_NPM_AUTH_TOKEN}" >> .npmrc
# the audit fails without a word on the lib, which comes from another scope
# (@fluxu-labs-old) under its old name: it has no use in the build anyway
RUN npm ci --no-audit
COPY . .
ARG VITE_HASURA_WSS
ARG VITE_HASURA_HTTPS
ARG VITE_HASURA_CLAIMS_NAMESPACE
#
ENV VITE_HASURA_WSS=${VITE_HASURA_WSS}
ENV VITE_HASURA_HTTPS=${VITE_HASURA_HTTPS}
ENV VITE_HASURA_CLAIMS_NAMESPACE=${VITE_HASURA_CLAIMS_NAMESPACE}
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf "server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
}" > /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]
