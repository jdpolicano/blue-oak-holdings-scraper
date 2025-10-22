FROM node:lts-bookworm-slim

# Set the working directory
# This is where the application code will live inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json tsconfig.json ./

# Install application dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY src ./src

# Copy the hbs templates
COPY templates ./templates

# Check if listings exist
COPY listings*.csv .

# Build the application
RUN npm run build

# Install the chromium browser with deps
RUN npm run install-browser


# Run the start command to kick off the application
CMD ["npm", "start"]
