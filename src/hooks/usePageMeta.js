import { useEffect } from "react";

/**
 * Sets document title + meta description for the current route.
 * No react-helmet-async dependency needed — this is a single-page
 * SPA so plain DOM mutation on mount is enough for the couple of
 * public routes (/ and /about) that matter for SEO.
 */
export default function usePageMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    let descTag = document.querySelector('meta[name="description"]');
    const prevDesc = descTag ? descTag.getAttribute("content") : null;
    if (description && descTag) {
      descTag.setAttribute("content", description);
    }

    return () => {
      document.title = prevTitle;
      if (descTag && prevDesc !== null) descTag.setAttribute("content", prevDesc);
    };
  }, [title, description]);
}
