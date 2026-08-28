"use client";

import Image from "next/image";
import { useState } from "react";

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase() || "JT";
}

export function UserAvatar({
  image,
  name,
  className = "user-avatar",
}: {
  image: string | null;
  name: string;
  className?: string;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const showImage = Boolean(image) && failedImage !== image;

  return (
    <span
      className={`${className} ${showImage ? "has-image" : ""}`}
      aria-hidden="true"
    >
      {showImage ? (
        <Image
          src={image!}
          alt=""
          width={96}
          height={96}
          sizes="48px"
          unoptimized
          onError={() => setFailedImage(image)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
