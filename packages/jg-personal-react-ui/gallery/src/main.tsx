import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Gallery } from './gallery.component.js';
import './styles.css';

const root = document.getElementById('root');
if (root === null) throw new Error('The gallery root is missing.');
createRoot(root).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
