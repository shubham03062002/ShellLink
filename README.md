# ShellLink

ShellLink is a mobile Linux server administration application that allows users to remotely monitor and manage Linux systems using SSH. The app provides real-time system monitoring, terminal access, process management, service control, and file browsing directly from a mobile device.

## Features

* Secure SSH-based remote connection
* Interactive Linux terminal
* Real-time CPU, RAM, and disk monitoring
* Process management (view and kill processes)
* Linux service management (start, stop, restart)
* Remote file explorer
* System monitoring dashboard
* Mobile-first interface for Linux administration

## Architecture

ShellLink uses a client-server architecture.

Mobile App (React Native + Expo)
↓
REST API (Node.js + Express)
↓
SSH Connection (ssh2 library)
↓
Remote Linux System

## Technology Stack

Frontend:

* React Native (Expo)
* TypeScript
* Expo Router
* Axios

Backend:

* Node.js
* Express.js
* ssh2 (SSH communication)

Other Tools:

* Git
* GitHub
* Linux

## Project Structure

ShellLink
│
├ Backend
│   ├ routes
│   │   └ system.js
│   ├ sshClient.js
│   ├ server.js
│
├ MobileApp
│   ├ app
│   ├ components
│   ├ context
│   ├ api
│
├ README.md

## Installation

### Clone Repository

git clone https://github.com/shubham03062002/ShellLink.git

cd ShellLink

### Backend Setup

cd Backend

npm install

node server.js

Server will start on:

http://localhost:3000

### Mobile App Setup

cd MobileApp

npm install

npx expo start

Scan the QR code with Expo Go to run the app.

## Usage

1. Open ShellLink mobile app
2. Enter Linux server IP address
3. Enter SSH username and password
4. Connect to server
5. Access monitoring dashboard, terminal, processes, services, and file manager

## Screens

* Dashboard – System overview
* Monitor – Live CPU and RAM monitoring
* Terminal – Interactive SSH terminal
* Processes – Manage running processes
* Services – Control Linux services
* Files – Remote file explorer
* Profile – Connection details
* About – Project information

## Security

* SSH credentials sent securely via request headers
* Backend validates requests using custom app secret header
* API access restricted to ShellLink mobile application

## Developer

Developed by **Shubham Asawale**

MSc Computer Science Graduate
Full Stack Developer
Linux & System Programming Enthusiast

Email: [shubhamasawale9@gmail.com](mailto:shubhamasawale9@gmail.com)
GitHub: https://github.com/shubham03062002
LinkedIn: https://linkedin.com/in/shubham-asawale

## License

This project is for educational and portfolio purposes.

## Future Improvements

* SSH key authentication
* WebSocket-based real-time terminal
* Graph-based system monitoring
* Multi-server management
* Secure authentication system
