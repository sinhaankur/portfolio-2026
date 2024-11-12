# Video Player Widget for Figma

The **Video Player Widget** allows you to embed videos from any URL directly into your Figma or FigJam canvas. This is a powerful tool for presenting video content alongside your designs or collaborating with teams using visual media.

---

## Widget Functionality

- **Embed Videos:** Add videos from platforms like YouTube, Vimeo, or any other embeddable source.
- **Customizable URLs:** Easily update the video URL using the widget's property menu.
- **Responsive Design:** Automatically adjusts to fit the widget's dimensions on the canvas.

---

## How to Use

1. **Insert the Widget:**
   - Go to the "Resources" panel in Figma or FigJam.
   - Search for "Video Player Widget" and add it to your canvas.

2. **Set Video URL:**
   - Right-click on the widget and select "Set Video URL" from the property menu.
   - Enter the URL of the video you'd like to embed and click OK.

3. **Enjoy Embedded Video Playback:**
   - The video will load and play directly within the widget frame.

---

## Build and Installation Steps

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) (comes with NPM).
- [Visual Studio Code](https://code.visualstudio.com/).

### Installation

1. **Clone the Repository:**
   ```bash
   git clone <repository-url>
   cd video-player-widget


First, download Node.js which comes with NPM. This will allow you to install TypeScript and other
libraries. You can find the download link here:

https://nodejs.org/en/download/

Next, install TypeScript, esbuild and the latest type definitions by running:

npm install

If you are familiar with JavaScript, TypeScript will look very familiar. In fact, valid JavaScript code
is already valid Typescript code.

TypeScript adds type annotations to variables. This allows code editors such as Visual Studio Code
to provide information about the Figma API while you are writing code, as well as help catch bugs
you previously didn't notice.

For more information, visit https://www.typescriptlang.org/

Using TypeScript requires a compiler to convert TypeScript (widget-src/code.tsx) into JavaScript (dist/code.js)
for the browser to run. We use esbuild to do this for us.

We recommend writing TypeScript code using Visual Studio code:

1. Download Visual Studio Code if you haven't already: https://code.visualstudio.com/.
2. Open this directory in Visual Studio Code.
3. Compile TypeScript to JavaScript: Run the "Terminal > Run Build Task..." menu item,
   then select "npm: watch". You will have to do this again every time
   you reopen Visual Studio Code.

That's it! Visual Studio Code will regenerate the JavaScript file every time you save.
