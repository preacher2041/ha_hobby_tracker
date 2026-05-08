ARG BUILD_FROM
FROM $BUILD_FROM

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --production

# Copy application files
COPY server.js ./
COPY index.html ./
COPY run.sh ./
RUN chmod +x run.sh

CMD ["/app/run.sh"]
