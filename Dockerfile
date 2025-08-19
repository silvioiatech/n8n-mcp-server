FROM node:18-alpine

WORKDIR /app

# Copier tout
COPY . .

# Installer dépendances
RUN npm install

# Exposer le port
EXPOSE $PORT

# Lancer directement TypeScript avec tsx
CMD ["npx", "tsx", "src/index.ts"]
