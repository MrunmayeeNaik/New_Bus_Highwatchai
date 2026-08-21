import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Router navigation swaps the page content without reloading the document, so the
// browser keeps whatever scroll position the previous page had. Moving from a long
// page (seat map, checkout) to a shorter one therefore lands the user partway down,
// often below the fold entirely. Reset to the top on every route change.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
