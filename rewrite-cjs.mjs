import glob from 'glob';
import { readFile, writeFile, rename } from 'fs';
import { promisify } from 'util';

// constants
const CJS_EXTENSION = '.cjs';
const MJS_PATTERN = /\.mjs/gm;
const FILE_OPTIONS = { encoding: 'utf-8' };

// get all cjs file
glob.sync('dist/cjs/**/*.mjs').forEach(path => {
	// rename the file
	const newPath = path.replace(MJS_PATTERN, CJS_EXTENSION);
	promisify(rename)(path, newPath)
		// read the file and change file extensions
		.then(() => promisify(readFile)(newPath, FILE_OPTIONS))
		.then(content => content.replace(MJS_PATTERN, CJS_EXTENSION))
		.then(content => writeFile(newPath, content, FILE_OPTIONS));
});

