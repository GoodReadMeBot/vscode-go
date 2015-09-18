/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import vscode = require('vscode');
import cp = require('child_process');
import path = require('path');

class FormattingSupport implements vscode.Modes.IFormattingSupport {

	private modelService: vscode.Services.IModelService;
	private formatCommand = "goreturns";

	public autoFormatTriggerCharacters: string[] = [';', '}', '\n'];

	constructor(modelService: vscode.Services.IModelService, configurationService: vscode.Services.IConfigurationService) {
		this.modelService = modelService;
		configurationService.loadConfiguration('go').then(config => {
			if(config.formatTool) {
				this.formatCommand = config.formatTool;
			}
		});
	}

	public formatDocument(resource: vscode.Uri, options: vscode.Modes.IFormattingOptions, token: vscode.CancellationToken):Thenable<vscode.Models.ISingleEditOperation[]> {
		// TODO: We don't really need to save all the buffers, just the one for 'resource'.
		return vscode.workspace.anyDirty().then(anyDirty => {
			if (anyDirty) {
				vscode.workspace.saveAll(false).then(() => {
					return this.doFormatDocument(resource, options, token);
				});
			}
			return this.doFormatDocument(resource, options, token);
		});
	}

	private doFormatDocument(resource: vscode.Uri, options: vscode.Modes.IFormattingOptions, token: vscode.CancellationToken):Thenable<vscode.Models.ISingleEditOperation[]> {
		return new Promise((resolve, reject) => {
			var filename = resource.fsPath;
			var model = this.modelService.getModel(resource);

			var goreturns = path.join(process.env["GOPATH"], "bin", this.formatCommand);

			cp.execFile(goreturns, [filename], {}, (err, stdout, stderr) => {
				try {
					if (err && (<any>err).code == "ENOENT") {
						vscode.shell.showInformationMessage("The 'goreturns' command is not available.  Use 'go get -u sourcegraph.com/sqs/goreturns' to install.");
						return resolve(null);
					}
					if (err) return reject("Cannot format due to syntax errors.");
					var result = stdout.toString();
					// TODO: Should use `-d` option to get a diff and then compute the
					// specific edits instead of replace whole buffer
					var lastLine = model.getLineCount();
					var lastLineLastCol = model.getLineMaxColumn(lastLine);
					return resolve([{
						text: result,
						range: {
							startLineNumber: 1,
							startColumn: 1,
							endLineNumber: lastLine,
							endColumn: lastLineLastCol
						}
					}]);
				} catch(e) {
					reject(e);
				}
			});
		});
	}

}

export = FormattingSupport