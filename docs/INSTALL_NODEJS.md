# Installing Node.js on Ubuntu

## Quick Install (Recommended)

### Option 1: Using NodeSource Repository (Latest LTS)

This installs Node.js 22.x (LTS version):

```bash
# Update package list
sudo apt update

# Install Node.js 22.x LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### Option 2: Using NVM (Node Version Manager)

NVM allows you to install and switch between multiple Node.js versions:

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Reload shell configuration
source ~/.bashrc

# Install Node.js LTS
nvm install --lts

# Verify installation
node --version
npm --version
```

### Option 3: Using Ubuntu's Default Repository (Older Version)

```bash
sudo apt update
sudo apt install -y nodejs npm

# Verify installation
node --version
npm --version
```

**Note:** This installs an older version. Use Option 1 or 2 for the latest.

## After Installation

Once Node.js is installed, you can run the Stripe setup script:

```bash
cd ~/ai-platform/customer-portal
node scripts/setup-stripe.mjs
```

## Verify Installation

```bash
# Check Node.js version
node --version
# Should show: v22.x.x or similar

# Check npm version
npm --version
# Should show: 10.x.x or similar

# Test Node.js
node -e "console.log('Node.js is working!')"
```

## Troubleshooting

### "command not found" after installation

Reload your shell:
```bash
source ~/.bashrc
# or
exec bash
```

### Permission errors with npm

If you get permission errors when installing packages globally:
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Old version installed

If you have an old version, remove it first:
```bash
sudo apt remove nodejs npm
sudo apt autoremove
# Then install using Option 1 or 2 above
```

## Which Option Should I Use?

- **Option 1 (NodeSource)**: Best for most users - latest stable version
- **Option 2 (NVM)**: Best if you need multiple Node.js versions
- **Option 3 (Ubuntu default)**: Quick but older version

I recommend **Option 1** for your use case.
