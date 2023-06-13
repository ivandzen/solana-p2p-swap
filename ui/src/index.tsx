/*
import React from 'react';
import {createRoot} from 'react-dom/client'
import { App } from './App';

const container = document.getElementById('app');
const root = createRoot(container!);
root.render(<App/>);
*/

import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';

ReactDOM.render(
    <StrictMode>
        <App />
    </StrictMode>,
    document.getElementById('app')
);