const path = require('node:path');
const sharp = require(process.argv[2]);

const root = path.resolve(__dirname, '..');
const rooms = [
  ['coworking', '#98caff'],
  ['reformer', '#3f9941'],
  ['wellness', '#c2d569'],
  ['bar', '#eb642b'],
  ['media', '#ffc100'],
];

async function cleanRoom(room, color) {
  const input = path.join(root, 'assets', `homepage-room-${room}-clean-2x.webp`);
  const output = path.join(root, 'assets', `homepage-room-${room}-no-text-2x.webp`);
  const image = sharp(input);
  const { width, height } = await image.metadata();
  const left = Math.round(width * 0.51);
  const top = Math.round(height * 0.17);
  const overlayWidth = Math.round(width * 0.45);
  const overlayHeight = Math.round(height * 0.59);
  const overlay = Buffer.from(`<svg width="${overlayWidth}" height="${overlayHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${color}"/></svg>`);

  await image
    .composite([{ input: overlay, left, top }])
    .webp({ quality: 92, effort: 6, smartSubsample: true })
    .toFile(output);
  process.stdout.write(`${path.basename(output)}\n`);
}

Promise.all(rooms.map(([room, color]) => cleanRoom(room, color))).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
