'use strict';

import * as path from 'path';

import { workspace, Disposable, ExtensionContext, window, Event, Uri, env, Diagnostic} from 'vscode';
import * as vscode from 'vscode';
import * as request from 'request';

export function activate(context: ExtensionContext) {
    let analyzer: RifleAnalyzer = new RifleAnalyzer();
    context.subscriptions.push(analyzer);

    let fileEvents: vscode.FileSystemWatcher = workspace.createFileSystemWatcher('**/*', false, false, false);
    context.subscriptions.push(fileEvents);
    
    let subscriptions: Disposable[] = [];
    let disposable1 = fileEvents.onDidCreate(analyzer.onDidCreate, this, subscriptions);
    let disposable2 = fileEvents.onDidChange(analyzer.onDidChange, this, subscriptions);
    let disposable3 = fileEvents.onDidDelete(analyzer.onDidDelete, this, subscriptions);
    
    context.subscriptions.push(Disposable.from(...subscriptions));
}

class RifleAnalyzer implements Disposable {  
    workspaceRoot = workspace.rootPath;
    sessionId: string = env.sessionId;
    
    diagnostics = vscode.languages.createDiagnosticCollection();
    
    public onDidCreate = (uri: Uri) => {
        console.log(`${this.sessionId} create – ${JSON.stringify(uri)}`);
    }
    
    public onDidChange = (uri: Uri) => {
        console.log(`${this.sessionId} change – ${JSON.stringify(uri)}`);
        
        let content: string = vscode.workspace.textDocuments.find((value, index, obj) => value.uri.path == uri.path).getText();
        
        request({
            method: 'PUT',
            baseUrl: "http://localhost:8080/codemodel/handle",
            uri: "?path=" + uri.path + "&sessionId=" + this.sessionId,
            body: content,
            gzip: true
        }).on('response', (resp) => {
            console.log(resp);
            request({
                method: 'GET',
                baseUrl: "http://localhost:8080/codemodel/unusedfunctions",
                uri: "",
                gzip: true
            }).on('data', (data: string) => {
                let response = JSON.parse(data);
                let diag: Diagnostic[] = [];
                
                for (var elem of response.unusedfunctions) {
                    diag.push(new Diagnostic(
                        new vscode.Range(
                            elem["start"].line,
                            elem["start"].column,
                            elem["end"].line,
                            elem["end"].column
                            ),
                        "This function is never used or not accessible.",
                        vscode.DiagnosticSeverity.Warning 
                    ));  
                }
                
                this.diagnostics.set(uri, diag);
                console.log(diag);
            });
        });
        

    }
    
    public onDidDelete = (uri: Uri) => {
        console.log(`${this.sessionId} delete – ${JSON.stringify(uri)}`);
    }

    dispose() {
        this.diagnostics.dispose();
    }
}