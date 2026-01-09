# Public Assets

This folder contains static assets that are served at the root URL.

## Usage

Place your logo files and other static assets in this folder.

### Examples:

- `public/logo.png` → Accessible at `/logo.png`
- `public/images/header-logo.svg` → Accessible at `/images/header-logo.svg`

## Next.js Public Folder

Files in the `public` folder are served statically and can be referenced in your code using absolute paths starting with `/`.

### In Components:

```tsx
<img src="/logo.png" alt="Logo" />
```

### In CSS:

```css
background-image: url('/logo.png');
```

