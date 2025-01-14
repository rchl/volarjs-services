import type { DocumentSelector, FormattingOptions, Result, ServiceContext, ServicePlugin, ServicePluginInstance, TextDocument } from '@volar/language-service';
import { SassFormatter, SassFormatterConfig } from 'sass-formatter';

export function create({
	documentSelector = ['sass'],
	isFormattingEnabled = () => true,
	getFormatterConfig = (_document, options) => options,
}: {
	documentSelector?: DocumentSelector;
	isFormattingEnabled?(document: TextDocument, context: ServiceContext): Result<boolean>;
	getFormatterConfig?(document: TextDocument, options: FormattingOptions, context: ServiceContext): Result<Partial<SassFormatterConfig>>;
} = {}): ServicePlugin {
	return {
		name: 'sass-formatter',
		create(context): ServicePluginInstance {
			return {
				async provideDocumentFormattingEdits(document, range, options) {

					if (!matchDocument(documentSelector, document))
						return;

					if (!await isFormattingEnabled(document, context))
						return;

					const config = await getFormatterConfig(document, options, context);

					// don't set when options.insertSpaces is false to avoid sass-formatter internal judge bug
					if (config.insertSpaces)
						config.tabSize = options.tabSize;

					return [{
						newText: SassFormatter.Format(document.getText(), config),
						range: range,
					}];
				},
			};
		},
	};
}

function matchDocument(selector: DocumentSelector, document: TextDocument) {
	for (const sel of selector) {
		if (sel === document.languageId || (typeof sel === 'object' && sel.language === document.languageId)) {
			return true;
		}
	}
	return false;
}
