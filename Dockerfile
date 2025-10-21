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

# Build the application
RUN npm run build

# Copy the built distribution files
COPY dist ./dist

# Copy the hbs templates
COPY templates ./templates

# Install the chromium browser with deps
RUN npm run install-browser

# Check if listings exist
COPY listings*.csv .

# Run the start command to kick off the application
CMD ["npm", "start"]
