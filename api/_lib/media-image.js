const sharp = require("sharp");
const { ApiError } = require("./http");

const SOURCE_MAX_BYTES = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const IMAGE_POLICIES = {
  avatar: { width: 512, height: 512, maxOutputBytes: 1 * 1024 * 1024 },
  background: { width: 1600, height: 1600, maxOutputBytes: 2 * 1024 * 1024 },
  gallery: { width: 1920, height: 1920, maxOutputBytes: 3 * 1024 * 1024 },
};
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

async function encodeWebp(input, mediaType) {
  const policy = IMAGE_POLICIES[mediaType];
  if (!policy) throw new TypeError("Unsupported media type.");
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new ApiError(422, "MEDIA_INVALID_IMAGE", "Choose a valid image.");
  }
  if (input.length > SOURCE_MAX_BYTES) {
    throw new ApiError(413, "MEDIA_TOO_LARGE", "Images must be 5 MB or smaller.");
  }

  let metadata;
  try {
    metadata = await sharp(input, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
      animated: true,
    }).metadata();
  } catch {
    throw new ApiError(422, "MEDIA_INVALID_IMAGE", "The uploaded file is not a supported image.");
  }
  if (
    !ACCEPTED_FORMATS.has(metadata.format) ||
    !Number.isInteger(metadata.width) ||
    !Number.isInteger(metadata.height) ||
    (metadata.pages || 1) !== 1
  ) {
    throw new ApiError(422, "MEDIA_INVALID_IMAGE", "Use a single-frame JPEG, PNG, or WebP image.");
  }

  for (const quality of [82, 74, 66, 58]) {
    let output;
    try {
      const image = sharp(input, {
        failOn: "error",
        limitInputPixels: MAX_INPUT_PIXELS,
      }).rotate();
      if (mediaType === "avatar") {
        image.resize(policy.width, policy.height, {
          fit: "cover",
          position: "centre",
        });
      } else {
        image.resize(policy.width, policy.height, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }
      output = await image.webp({ quality, effort: 5 }).toBuffer();
    } catch {
      throw new ApiError(422, "MEDIA_INVALID_IMAGE", "The uploaded image could not be processed.");
    }
    if (output.length <= policy.maxOutputBytes) return output;
  }

  throw new ApiError(
    422,
    "MEDIA_OUTPUT_TOO_LARGE",
    "The image could not be compressed to the allowed size.",
  );
}

module.exports = {
  ACCEPTED_FORMATS,
  IMAGE_POLICIES,
  MAX_INPUT_PIXELS,
  SOURCE_MAX_BYTES,
  encodeWebp,
};
