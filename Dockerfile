# Use a base image
FROM ubuntu:latest

# Set the working directory inside the container
WORKDIR /app

# Copy the application files to the container
COPY . /app

# Install dependencies (if needed)
RUN apt-get update && apt-get install -y <package_name>

# Expose a port (if needed)
EXPOSE <port_number>

# Define the command to run your application
CMD ["<command_to_start_your_application>"]
