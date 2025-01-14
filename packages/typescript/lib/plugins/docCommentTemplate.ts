import type * as vscode from '@volar/language-service';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as nls from 'vscode-nls';
import { isTsDocument } from '../shared';
import { getLanguageService } from '../syntacticLanguageService';
import { getLineText } from '../utils/lspConverters';

const localize = nls.loadMessageBundle(); // TODO: not working

const defaultJsDoc = `/**\n * $0\n */`;

export function create(ts: typeof import('typescript')): vscode.ServicePlugin {
	return {
		name: 'typescript-doc-comment-template',
		triggerCharacters: ['*'],
		create(): vscode.ServicePluginInstance {

			return {

				provideCompletionItems(document, position) {

					if (!isTsDocument(document))
						return;

					if (!isPotentiallyValidDocCompletionPosition(document, position))
						return;

					const { languageService, fileName } = getLanguageService(ts, document);
					const offset = document.offsetAt(position);
					const docCommentTemplate = languageService.getDocCommentTemplateAtPosition(fileName, offset);
					if (!docCommentTemplate)
						return;

					let insertText: string;

					// Workaround for #43619
					// docCommentTemplate previously returned undefined for empty jsdoc templates.
					// TS 2.7 now returns a single line doc comment, which breaks indentation.
					if (docCommentTemplate.newText === '/** */') {
						insertText = defaultJsDoc;
					} else {
						insertText = templateToSnippet(docCommentTemplate.newText);
					}

					const item = createCompletionItem(document, position, insertText);

					return {
						isIncomplete: false,
						items: [item],
					};
				},
			};
		},
	};
}

function createCompletionItem(document: TextDocument, position: vscode.Position, insertText: string) {

	const item: vscode.CompletionItem = { label: '/** */' };
	item.kind = 1 satisfies typeof vscode.CompletionItemKind.Text;
	item.detail = localize('typescript.jsDocCompletionItem.documentation', 'JSDoc comment');
	item.sortText = '\0';
	item.insertTextFormat = 2 satisfies typeof vscode.InsertTextFormat.Snippet;

	const line = getLineText(document, position.line);
	const prefix = line.slice(0, position.character).match(/\/\**\s*$/);
	const suffix = line.slice(position.character).match(/^\s*\**\//);
	const start: vscode.Position = { line: position.line, character: position.character + (prefix ? -prefix[0].length : 0) };
	const end: vscode.Position = { line: position.line, character: position.character + (suffix ? suffix[0].length : 0) };
	const range: vscode.Range = { start, end };
	item.textEdit = { range, newText: insertText };

	return item;
}

function isPotentiallyValidDocCompletionPosition(
	document: TextDocument,
	position: vscode.Position
): boolean {
	// Only show the JSdoc completion when the everything before the cursor is whitespace
	// or could be the opening of a comment
	const line = getLineText(document, position.line);
	const prefix = line.slice(0, position.character);
	if (!/^\s*$|\/\*\*\s*$|^\s*\/\*\*+\s*$/.test(prefix)) {
		return false;
	}

	// And everything after is possibly a closing comment or more whitespace
	const suffix = line.slice(position.character);
	return /^\s*(\*+\/)?\s*$/.test(suffix);
}

function templateToSnippet(template: string): string {
	// TODO: use append placeholder
	let snippetIndex = 1;
	template = template.replace(/\$/g, '\\$');
	template = template.replace(/^[ \t]*(?=(\/|[ ]\*))/gm, '');
	template = template.replace(/^(\/\*\*\s*\*[ ]*)$/m, (x) => x + `\$0`);
	template = template.replace(/\* @param([ ]\{\S+\})?\s+(\S+)[ \t]*$/gm, (_param, type, post) => {
		let out = '* @param ';
		if (type === ' {any}' || type === ' {*}') {
			out += `{\$\{${snippetIndex++}:*\}} `;
		} else if (type) {
			out += type + ' ';
		}
		out += post + ` \${${snippetIndex++}}`;
		return out;
	});

	template = template.replace(/\* @returns[ \t]*$/gm, `* @returns \${${snippetIndex++}}`);

	return template;
}
