import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import telecomIcon from './assets/telecom.png'

// Ensure favicon and apple-touch-icon use the telecom image
const setIcon = (rel: string, href: string, type?: string) => {
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    if (type) link.type = type;
    document.head.appendChild(link);
  } else {
    if (type) link.type = type;
  }
  link.href = href;
};

setIcon('icon', telecomIcon, 'image/png');
setIcon('apple-touch-icon', telecomIcon);

createRoot(document.getElementById("root")!).render(<App />);
