onmessage = async (e) => {
  const { 号, 帧, 宽, 高, 列, 出宽, 出高 } = e.data, 址们 = e.data.址们 || [e.data.址], 每页 = e.data.每页 || 帧;
  try {
    const 缩 = 出高 < 高 ? { resizeWidth: 出宽, resizeHeight: 出高, resizeQuality: "high" } : {}, 帧们 = [];
    for (let k = 0;k < 址们.length; k++) {
      const r = await fetch(址们[k], { credentials: "same-origin" });
      if (!r.ok)
        throw new Error(`取 ${址们[k]} → HTTP ${r.status}`);
      const 大 = await createImageBitmap(await r.blob()), n = Math.min(每页, 帧 - k * 每页);
      帧们.push(...await Promise.all(Array.from({ length: n }, (_, i) => createImageBitmap(大, i % 列 * 宽, Math.floor(i / 列) * 高, 宽, 高, 缩))));
      大.close();
    }
    postMessage({ 号, 帧们 }, 帧们);
  } catch (err) {
    postMessage({ 号, 错: String(err && err.message || err) });
  }
};
