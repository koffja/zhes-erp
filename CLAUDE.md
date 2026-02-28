# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

折石ERP (Coffee ERP) - An Express-based ERP system for coffee shop management using SQLite database.

## Commands

```bash
# Install dependencies
npm install

# Start the server (development)
node temp.js

# Service management (start/stop/restart/status)
./server.sh start
./server.sh stop
./server.sh restart
./server.sh status

# Enable macOS开机自启动 (requires sudo)
sudo cp com.coffee.erp.plist /Library/LaunchDaemons/
sudo launchctl load /Library/LaunchDaemons/com.coffee.erp.plist
```

## Architecture

- **Main Server**: `temp.js` - Express server running on port 5271
- **Database**: SQLite at `data/erp.db` (better-sqlite3)
- **Frontend**: Static HTML at `public/index.html`
- **PDF Generation**: Generates order PDFs stored in `data/`
- **Service Script**: `server.sh` handles daemonization and process management
- **LaunchDaemon**: `com.coffee.erp.plist` for macOS boot startup

## Key Tables

- `orders` - Order records
- `order_items` - Line items for orders
- `products` - Product catalog
- `product_aliases` - Product name aliases
- `customers` - Customer information
- `inventory` - Stock/inventory tracking
