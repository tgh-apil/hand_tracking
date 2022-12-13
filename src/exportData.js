import fs from 'fs'
import { handData } from './stores.js';


export const exportData = function() {
    console.log('test');

    let data = handData;

    fs.writeFile('test.txt', 'what the hell', function(err) {
        if (err) {
            console.log(err);
        }
    })
}