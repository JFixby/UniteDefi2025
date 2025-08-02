import * as bolt11 from 'bolt11';

// Replace this with your actual invoice
const invoice = 'lnbc100u1p5guy6ypp5eeyft8ntelam75uvpnz8lcx46qpp5aa6a4rrvc2qtc74qaz8776scqzyssp5us7lxaq6xny2e85sjfxa6dttua7v0ag32q2huzue5m67czzj5nes9q7sqqqqqqqqqqqqqqqqqqqsqqqqqysgqdqqmqz9gxqyjw5qrzjqwryaup9lh50kkranzgcdnn2fgvx390wgj5jd07rwr3vxeje0glcllmqlf20lk5u3sqqqqlgqqqqqeqqjqr4dqnmedj6pz9jvh2ufw0v0grfa27khg7tfwvun8u9fcxg952ua5zed68d2naa6whng33z7qnvt8x5x07lzf6lchegvr70xsrjmk8uqpsjef9k';

try {
  const decoded = bolt11.decode(invoice);
  console.log("Decoded Invoice:");
  console.log(JSON.stringify(decoded, null, 2));
} catch (error) {
  console.error("Failed to decode invoice:", error);
} 