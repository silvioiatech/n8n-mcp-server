FROM node:18-alpine

# Créer le répertoire de travail
WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY tsconfig.json ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY src ./src

# Build du projet
RUN npm run build

# Exposer le port
EXPOSE $PORT

# Variables d'environnement par défaut
ENV NODE_ENV=production

# Commande de démarrage
CMD ["npm", "start"]
