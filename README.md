# evaluate-yourself

<p align="center">
	<img src="public/assets/logo.png" alt="Evaluate Yourself Logo" width="220" />
</p>

An elegant pre-interview evaluation web app that measures and analyzes interpersonal and presentation skills. The project focuses on a clean UI, modern typography (Inter), and a professional, card-based design system using Material UI.

---

## Features

- Clean, professional UI with Inter (geometric sans-serif) typography
- Card-based layout for clear metrics and charts
- Material-UI icons and components for consistent styling
- Real-time interview experience with webcam and text-to-speech for questions
- Detailed post-interview analytics (eye contact, speaking time, confidence)
- Rating and feedback collection

---

## Screenshots

> Replace these examples with real screenshots from `public/assets` as needed.

![Landing Screenshot](public/assets/skillevaluation.png)

---

## Stylish Chips (Material-UI Example)

Use the following snippet to render stylish chips that match the app's clean aesthetic.

```jsx
import React from 'react';
import { Chip, Stack } from '@mui/material';
import { Verified, Star } from '@mui/icons-material';

export default function StylishChips() {
	return (
		<Stack direction="row" spacing={1}>
			<Chip
				icon={<Verified />}
				label="Verified"
				sx={{
					bgcolor: '#e8f0fe',
					color: '#174ea6',
					fontWeight: 600,
					borderRadius: '12px'
				}}
			/>
			<Chip
				icon={<Star />}
				label="Top Performer"
				sx={{
					bgcolor: '#fff4e5',
					color: '#7a4a00',
					fontWeight: 600,
					borderRadius: '12px'
				}}
			/>
		</Stack>
	);
}
```

---

## Assets

Place logos and screenshots in `public/assets/`:

- `public/assets/logo.png` — App logo (used in README and header)
- `public/assets/landing-screenshot.png` — Landing page screenshot
- `public/assets/report-screenshot.png` — Report page screenshot

If these images are missing, add them to the `public/assets` directory. A placeholder `logo.png` was added in this branch.

---

## Local development

Install dependencies and run locally:

```powershell
# install
npm install

# start dev server (create-react-app default)
npm start
```

Open http://localhost:3000 in your browser. If port 3000 is occupied, the dev server will prompt to use another port.

---

## Contributing

Contributions are welcome. Create a branch, make changes, and open a pull request against `main`.

---

## License

This project is released under the terms of the MIT License. See `LICENSE` for details.

