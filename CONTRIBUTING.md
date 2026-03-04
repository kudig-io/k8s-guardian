# Contributing to k8s-guardian

First off, thank you for considering contributing to k8s-guardian! It's people like you that make k8s-guardian such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs if possible**
- **Include your environment details** (OS, Node.js version, Kubernetes version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior and explain the behavior you expected**
- **Explain why this enhancement would be useful**

### Pull Requests

- Fill in the required template
- Do not include issue numbers in the PR title
- Include screenshots and animated GIFs in your pull request whenever possible
- Follow the JavaScript style guide
- Include thoughtfully-worded, well-structured tests
- Document new code based on the Documentation Style Guide
- End all files with a newline

## Development Setup

### Prerequisites

- Node.js >= 16.0.0
- npm >= 8.0.0
- Kubernetes cluster (for testing)
- kubectl configured

### Installation

```bash
# Clone the repository
git clone https://github.com/kudig-io/k8s-guardian.git

# Navigate to the project directory
cd k8s-guardian

# Install dependencies
npm install

# Set up Git hooks
npm run prepare
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:ci
```

### Code Style

This project uses ESLint and Prettier to enforce code style:

```bash
# Check code style
npm run lint

# Fix code style issues
npm run lint:fix

# Format code
npm run format
```

### Commit Messages

We follow the Conventional Commits specification:

- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that do not affect the meaning of the code
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `perf:` A code change that improves performance
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process or auxiliary tools

Example:
```
feat: add support for custom dashboards

Add ability to create and manage custom dashboards for monitoring
Kubernetes resources. Users can now define their own dashboard layouts
and save them for later use.

Closes #123
```

## Project Structure

```
k8s-guardian/
├── bin/              # CLI entry point
├── src/              # Source code
│   ├── __tests__/   # Test files
│   ├── config.js    # Configuration management
│   ├── logger.js    # Logging system
│   ├── metrics.js   # Prometheus metrics
│   └── ...
├── helm/             # Helm charts
├── monitoring/       # Monitoring configurations
├── web-ui/           # Web UI files
└── ...
```

## Additional Notes

### Issue and Pull Request Labels

- `bug` - Issues that are bugs
- `enhancement` - Issues that are enhancements
- `documentation` - Issues related to documentation
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed

## Recognition

Contributors will be recognized in our README and release notes.

Thank you for your contributions! 🎉
