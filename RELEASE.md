# 🚀 HouseKit Release System

This project uses a custom release system based on **Semantic Versioning (SemVer)**. It automatically detects changes, bumps versions, builds packages, and publishes to NPM.

## 📖 Semantic Versioning (SemVer)

Versions follow the `MAJOR.MINOR.PATCH` format:
- **MAJOR**: Breaking changes (e.g., `1.0.0`)
- **MINOR**: New backward-compatible features (e.g., `0.1.0`)
- **PATCH**: Backward-compatible bug fixes (e.g., `0.0.1`)

---

## 🎯 Quick Start Commands

The most common way to release is using the "Smart Release" which only bumps packages that have changed since the last release tag.

```bash
# Release bug fixes (Patch bump) - DEFAULT
npm run release:all

# Release new features (Minor bump)
npm run release:all -- --minor

# Release breaking changes (Major bump)
npm run release:all -- --major

# Release a specific version
npm run release:all -- --version=1.0.0
```

---

## 🔧 Command Reference

### Smart Release (Recommended)
Automatically detects changed packages using Git and follows the dependency chain (if the ORM changes, the Kit is also bumped).

| Command | Result Example | When to use |
| :--- | :--- | :--- |
| `npm run release:all` | `1.0.1 -> 1.0.2` | Bug fixes (default) |
| `npm run release:all -- --minor` | `1.0.1 -> 1.1.0` | New features |
| `npm run release:all -- --major` | `1.0.1 -> 2.0.0` | Breaking changes |
| `npm run release:all -- --version=X.Y.Z` | `-> X.Y.Z` | Specific version |

### Individual Package Release
If you want to force a release for a single package:

```bash
# @housekit/orm
npm run release:orm -- --patch

# @housekit/kit
npm run release:kit -- --minor
```

---

## 🔍 How it Works

1. **Detection**: The system looks for the latest Git tag (e.g., `v1.0.0`) and runs `git diff` to see which files in `packages/*` have changed.
2. **Dependency Chain**: 
   - If `@housekit/orm` changes -> Both **ORM** and **Kit** are bumped.
   - If only `@housekit/kit` changes -> Only the **Kit** is bumped.
3. **Bumping**: Updates `package.json` files and synchronizes internal dependencies.
4. **Building**: Runs the optimized build process (including worker generation and tree-shaking optimizations).
5. **Publishing**: Uploads the packages to NPM with public access.

---

## 🏷️ Standard Release Workflow

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: added new awesome feature"
   ```
2. **Execute Release**:
   ```bash
   # Choose the bump type based on your changes
   npm run release:all -- --minor
   ```
3. **Tag and Push**:
   ```bash
   # Create a tag for the new version
   git tag v1.1.0
   git push origin main --tags
   ```

---

## 🐛 Troubleshooting

### "Access token expired or revoked"
Run `npm login` to refresh your credentials. Note that publishing to the `@housekit` organization requires an account with appropriate permissions.

### "No packages were bumped"
The system didn't detect any changes in the `packages/` directory since the last Git tag. Ensure you have committed your changes.

### CI/CD Failures
If the release fails in GitHub Actions, ensure the `NPM_TOKEN` (Automation type) is correctly set in your repository secrets.

---

## 🎓 Best Practices

1. **Conventional Commits**: Use `feat:`, `fix:`, or `feat!:` to make it easier to decide the bump type.
2. **Atomic Releases**: Try to release frequently to keep the delta between versions small.
3. **Stable Versions**: Use `0.x.x` for initial development and move to `1.0.0` once the API is stable.

---

MIT © [Pablo Fernandez Ruiz](https://github.com/pablofdezr)