import covers from "./assets/course-covers.json";

export function coverImage(source, catalog = false) {
  const image = covers[source];
  if (!image) return { src: source };
  return {
    src: image.src,
    srcSet: image.srcSet,
    sizes: catalog
      ? "(max-width: 450px) calc(50vw - 35px), (max-width: 900px) calc(50vw - 45px), 270px"
      : "(max-width: 700px) 40vw, 550px",
  };
}
