<script>
  export let width = 100;
  export let height = 100;
  export let quality = 90;
  export let src = "";
  export let displayHeight = height;
  export let displayWidth = width;
</script>

<img
  src="{src}?w={width}&h={height}&q={quality}"
  width={displayWidth}
  height={displayHeight}
  alt="Product"
/>
