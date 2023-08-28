/**
 * @file This loader will scan any contents for the "tag" <webpack-foo src="bar.html"> and replace it with 
 *       something else (for details see the default and only export of this file: parseAndReplace() the 
 *       webpack.config.js file.
 * 
 * @todo Add source maps
 * 
 * @author plundell
 * @date 2023-05-16
 */
import * as path from 'path';
import * as cp from 'child_process';
import * as fs from 'fs';
import { LoaderContext } from 'webpack';


type LoaderWithoutOptions = LoaderContext<undefined>

export function HtmlInjectorLoader(this: LoaderWithoutOptions, source: string): void {
	const callback = this.async();
	const result = parseAndReplace.call(this, source, this.resourcePath);
	callback(null, result);
}


/**
 * Parse a string ($contents) for the "tag" <webpack-foo arg="bar.html"> and replace it with something else. 
 * foo can be either 'inject' or 'import' or the name of a function on the global object which returns a 
 * string to inject (see getInjectorFunc(), and bar.html is the first arg passed to that function (usually 
 * a path or search string but technically it could be anything), the second being the $resourcePath. 
 * 
 * @param string contents      The contents of a resource file
 * @param string resourcePath  The path of the resource file which contains $contents
 * 
 * @return string              The modified $contents
 * @export
 */
export function parseAndReplace(this: LoaderWithoutOptions, contents: string, resourcePath: string) {
	//Regexp which matches all the tags in this file. DevNote: we tried just getting the first one and then searching/replacing
	//again and again but that would cause relative paths to become wrong, so instead we call this whole function recursively
	const regexp = /(^[\t ]*)?<webpack-([a-z]+) src=("|')([^\3]+)\3\s*\/?>/mg;

	const matches = Array.from(contents.matchAll(regexp));
	for (const match of matches) {
		const [wholeTag, whitespace, func, , src] = match;
		try {
			//First get the replacement string using the function of choice
			var replacement = getInjectorFunc(func).call(this, src, resourcePath);

			//Now search recursively through the replacement text
			replacement = parseAndReplace.call(this, replacement, src);
		} catch (e) {
			console.error(new Error(`<webpack-${func}> tag failed @ ${resourcePath}:${match.index}`), e);
			replacement = wrapInCommentSyntax(wholeTag, resourcePath);
		}

		//If whitespace was detected, intent each line of the replacement
		if (whitespace)
			replacement = replacement.replace(/^/gm, whitespace);

		//Since the file might contain many matches the match.index won't work for anything but the first replacement, so we 
		//search the contents for the whole tag to get a new starting point...
		const start = contents.indexOf(wholeTag);
		contents = contents.slice(0, start) + replacement + contents.slice(start + wholeTag.length);

	}

	return contents;
}


/**
 * Get a callable function denoted by the tag. 
 * 
 * @param string func   The part after the hyphen of the <webpack-func src="..."> tag
 * 
 * @return function
 */
export function getInjectorFunc(func: string) {
	switch (func) {
		case 'inject': 
			return getFileContents;
		case 'import': 
			return addImportStatements;
		default:
			throw new Error("No such inject function found: " + func);
	}
}

/**
 * Wrap a string in comment syntax specific to the type of file it's going into
 * 
 * @param string str           The string to be wrapped
 * @param string resourcePath  The file containing the string. Used to determine file type
 * 
 * @return string              The wrapped string
 */
export function wrapInCommentSyntax(str: string, resourcePath: string) {
	const match = resourcePath.match(/\.([a-z]{3,4})$/);
	if (match) {
		if (match[1] == 'html')
			return '<!-- ' + str + ' -->';
		else
			return '/* ' + str + ' */';
	} else {
		throw new Error("Not a valid file path: " + String(resourcePath));
	}
}

/**
 * Get a list of files matching a pattern (optionally relative to a given location if pattern is not absolute)
 * 
 * @param string pattern        A file matching pattern like "./styles/*.less"
 * @param string resourcePath   The file containing the pattern. Used to determine relative paths and import syntax
 * 
 * @return Array<string>        An array of absolute file paths
 */
export function findMatchingFiles(pattern: string, relativeTo: string) {
	try {
		return cp.execFileSync('find', [relativeTo, '-type', '-f', '-name', pattern], { stdio: 'pipe' }).toString().split('\n');
	} catch (e) {
		throw new Error(`Failed fo find files matching '${pattern}' relative to ${relativeTo}`, { cause: e });
	}
}

/**
* Generates import statements matching a pattern. Works in both css/less/scss and js/ts/tsx
*
* @param string pattern        A file matching pattern like "./styles/*.less"
* @param string resourcePath   The file containing the pattern. Used to determine relative paths and import syntax
* 
* @return string               A newline-delimited string, one relative path per line prepended by @import/import
*/
export function addImportStatements(pattern: string, resourcePath: string) {

	const relativeTo = path.dirname(resourcePath);
	const files = findMatchingFiles(pattern, relativeTo);

	if (!files.length) {
		throw new Error(`No files matched pattern '${pattern}' relative to ${relativeTo}`);
	} else {
		//Determine syntax based on file type
		const imprt = ['js', 'ts', 'tsx', 'jsx'].includes(path.extname(resourcePath)) ? 'import' : '@import';

		const replacement = files.map(p => `${imprt} "${p}";\n`).join('');

		console.log(`Injecting ${files.length} ${imprt} statments in ${resourcePath} for files matching pattern '${pattern}'`,
			replacement.split('\n').join('\n    '));

		return replacement;
	}
}




/**
* Load the contents of one or more files and make it a dependency of the original resource (ie. the file which called 
* the loader, not the possibly nested file which is currently being parsed for tags)
*
* @param string getFrom       Path of file to get contents from
* @param string insertInto    Path of file containing the <webpack-insert> tag. Used for relative references
*
* @return string              The contents $getFrom
*/
export function getFileContents(this: LoaderWithoutOptions, getFrom: string, insertInto: string) {
	try {
		console.log(`Inserting ${getFrom} into ${insertInto}`);
		const fullpath = path.resolve(insertInto, getFrom);

		//Get the contents of the file
		const contents = fs.readFileSync(fullpath).toString().trim();

		//Add new new filr as a dependency of the original file
		this.addDependency(fullpath); 

		return contents;
	} catch (e) {
		throw new Error(`Failed to get contents from ${getFrom} (relative to ${insertInto})`);
	}
}





export default HtmlInjectorLoader;