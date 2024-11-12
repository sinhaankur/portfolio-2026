// Import the necessary widget modules
const { widget } = figma;
const { AutoLayout, Text, Frame, useSyncedState, usePropertyMenu } = widget;

function VideoPlayerWidget() {
  // Synced state for the video URL
  const [videoUrl, setVideoUrl] = useSyncedState("videoUrl", "");

  // Property menu to update video URL
  usePropertyMenu(
    [
      {
        itemType: "action",
        tooltip: "Set Video URL",
        propertyName: "setUrl",
      },
    ],
    ({ propertyName }) => {
      if (propertyName === "setUrl") {
        const newUrl = prompt("Enter the video URL:", videoUrl || "");
        if (newUrl !== null) {
          setVideoUrl(newUrl.trim());
        }
      }
    }
  );

  return (
    <AutoLayout
      direction="vertical"
      padding={16}
      spacing={16}
      cornerRadius={8}
      fill="#F9F9F9"
      stroke="#CCCCCC"
      strokeWidth={1}
    >
      <Text fontSize={16} fontWeight="bold">
        Video Player
      </Text>
      {videoUrl ? (
        <Frame
          width={320}
          height={180}
          overflow="hidden"
          cornerRadius={8}
          fill="#000000"
        >
          <iframe
            src={videoUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            allowFullScreen
          ></iframe>
        </Frame>
      ) : (
        <Text fontSize={14} opacity={0.6}>
          No video URL set. Use the property menu to add one.
        </Text>
      )}
    </AutoLayout>
  );
}

// Register the widget
widget.register(VideoPlayerWidget);
