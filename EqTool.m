function EqTool()
% EqTool - MATLAB Bidirectional Equation Visualizer
%
% Launch with:  >> EqTool
%
% On first run, dependencies are downloaded and bundled automatically.
% An internet connection is required for the first run only.
%
% Requirements: MATLAB R2020b or later

    eqtool_log('EqTool launch started');

    toolDir   = fileparts(mfilename('fullpath'));
    srcFile   = fullfile(toolDir, 'matlab_equation_tool.html');
    % Write bundled file to a versioned userpath folder (always writable, even in read-only install dirs).
    % Bump this folder name when forcing a clean runtime cache.
    userDir   = fullfile(userpath, 'EqTool_v2');
    eqtool_log('toolDir=%s', toolDir);
    eqtool_log('srcFile=%s', srcFile);
    eqtool_log('userDir=%s', userDir);
    if ~isfolder(userDir), mkdir(userDir); end
    bundled   = fullfile(userDir, 'matlab_equation_tool_bundled.html');
    eqtool_log('bundled=%s', bundled);

    if ~isfile(srcFile)
        eqtool_log('ERROR: source HTML not found');
        error('EqTool: cannot find matlab_equation_tool.html in %s', toolDir);
    end

    % Bundle on first run, or if any local source asset is newer than bundled file
    needsBundle = ~isfile(bundled);
    eqtool_log('bundled exists=%d', ~needsBundle);
    if ~needsBundle
        bndInfo = dir(bundled);
        sourceAssets = {
            srcFile,
            fullfile(toolDir, 'styles', 'main.css'),
            fullfile(toolDir, 'src', 'js', 'core.js'),
            fullfile(toolDir, 'src', 'js', 'ui.js')
        };
        for i = 1:numel(sourceAssets)
            if ~isfile(sourceAssets{i})
                eqtool_log('asset missing (skipped for freshness): %s', sourceAssets{i});
                continue;
            end
            srcInfo = dir(sourceAssets{i});
            eqtool_log('asset mtime check: %s (%.6f) vs bundled (%.6f)', sourceAssets{i}, srcInfo.datenum, bndInfo.datenum);
            if srcInfo.datenum > bndInfo.datenum
                needsBundle = true;
                eqtool_log('bundle refresh needed because asset is newer: %s', sourceAssets{i});
                break;
            end
        end
        if ~needsBundle
            bundleOk = eqtool_validate_bundle(bundled);
            eqtool_log('bundle integrity check ok=%d', bundleOk);
            if ~bundleOk
                needsBundle = true;
                eqtool_log('bundle refresh needed because integrity check failed');
            end
        end
    end
    if needsBundle
        eqtool_log('running bundler...');
        ok = eqtool_bundle(srcFile, bundled);
        eqtool_log('bundler returned ok=%d', ok);
        if ~ok
            eqtool_log('aborting launch because bundling failed');
            return;
        end
    else
        eqtool_log('bundle is up to date; skipping bundling');
    end

    % Launch window
    eqtool_log('creating UIFigure/UIHTML...');
    fig = uifigure( ...
        'Name',               'MATLAB Equation Tool', ...
        'Position',           [100 100 860 680], ...
        'Resize',             'on', ...
        'AutoResizeChildren', 'off' ...
    );

    html = uihtml(fig, ...
        'Position',   [0 0 fig.Position(3) fig.Position(4)], ...
        'HTMLSource', bundled ...
    );
    eqtool_log('UIHTML created with source=%s', bundled);

    fig.SizeChangedFcn = @(src,~) set(html, 'Position', [0 0 src.Position(3) src.Position(4)]);
    eqtool_log('EqTool launch finished');
end


function ok = eqtool_bundle(srcFile, outFile)
% Downloads and inlines all JS/CSS dependencies into a single HTML file.

    ok = false;
    toolDir = fileparts(srcFile);
    eqtool_log('bundle start: src=%s out=%s', srcFile, outFile);

    DEPS = { ...
        'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',       'css'; ...
        'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',        'js';  ...
        'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',       'js';  ...
        'https://cdn.jsdelivr.net/npm/mathquill@0.10.1/build/mathquill.css',  'css'; ...
        'https://cdn.jsdelivr.net/npm/mathquill@0.10.1/build/mathquill.min.js','js'; ...
    };

    FONT_BASE = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/fonts/';

    % Progress dialog — figure must be visible for uiprogressdlg
    progFig = uifigure('Visible','on','Position',[-2000 -2000 1 1]);
    dlg = uiprogressdlg(progFig, ...
        'Title',       'EqTool — First Run Setup', ...
        'Message',     'Downloading dependencies...', ...
        'Indeterminate','off', ...
        'Cancelable',  'off', ...
        'Value',       0 ...
    );

    nDeps = size(DEPS, 1);
    inlineCSS = '';
    inlineJS  = '';

    try
        for i = 1:nDeps
            url  = DEPS{i,1};
            kind = DEPS{i,2};
            name = url(find(url=='/',1,'last')+1:end);

            dlg.Message = sprintf('Downloading %s  (%d/%d)', name, i, nDeps+1);
            dlg.Value   = (i-1) / (nDeps+1);
            eqtool_log('fetching dependency %d/%d: %s', i, nDeps, url);

            opts = weboptions('Timeout', 30, 'ContentType', 'text');
            text = webread(url, opts);
            eqtool_log('fetched %s (%d chars)', name, numel(text));

            if strcmp(kind, 'css')
                % Inline KaTeX fonts as base64 data URIs
                if contains(url, 'katex') && contains(url, '.css')
                    dlg.Message = 'Inlining KaTeX fonts...';
                    text = eqtool_inline_fonts(text, FONT_BASE, dlg, nDeps);
                    eqtool_log('inlined KaTeX fonts into CSS');
                end
                inlineCSS = [inlineCSS, text, newline]; %#ok<AGROW>
            else
                inlineJS = [inlineJS, text, newline]; %#ok<AGROW>
            end
        end

        % Read source HTML
        dlg.Message = 'Assembling bundled file...';
        dlg.Value   = nDeps / (nDeps+1);

        fid = fopen(srcFile, 'r', 'n', 'UTF-8');
        html = fread(fid, '*char')';
        fclose(fid);
        eqtool_log('read source HTML (%d chars)', numel(html));

        % Read local split assets and inline them so bundled HTML stays standalone.
        localCSS = eqtool_read_text(fullfile(toolDir, 'styles', 'main.css'));
        localCoreJS = eqtool_read_text(fullfile(toolDir, 'src', 'js', 'core.js'));
        localUIJS = eqtool_read_text(fullfile(toolDir, 'src', 'js', 'ui.js'));
        eqtool_log('read local CSS (%d chars), core.js (%d chars), ui.js (%d chars)', numel(localCSS), numel(localCoreJS), numel(localUIJS));

        % Strip CDN link/script tags
        html = regexprep(html, '<link[^>]+href="https://[^"]*"[^>]*>\s*', '');
        html = regexprep(html, '<script[^>]+src="https://[^"]*"[^>]*></script>\s*', '');
        html = regexprep(html, '<link[^>]+fonts\.googleapis[^>]*>\s*', '');
        html = regexprep(html, '<link[^>]+fonts\.gstatic[^>]*>\s*', '');

        % Strip local asset tags (they will be inlined below).
        html = regexprep(html, '<link[^>]+href="styles/main\.css"[^>]*>\s*', '');
        html = regexprep(html, '<script[^>]+src="src/js/core\.js"[^>]*></script>\s*', '');
        html = regexprep(html, '<script[^>]+src="src/js/ui\.js"[^>]*></script>\s*', '');

        % Inject inlined deps before </head>
        inject = ['<style>', inlineCSS, newline, localCSS, '</style>', newline, ...
              '<script>', inlineJS, newline, localCoreJS, newline, localUIJS, '</script>', newline];
        html = strrep(html, '</head>', [inject, '</head>']);

        % Write bundled file
        fid = fopen(outFile, 'w', 'n', 'UTF-8');
        fwrite(fid, html, 'char');
        fclose(fid);
        outInfo = dir(outFile);
        eqtool_log('wrote bundled HTML (%d bytes)', outInfo.bytes);

        dlg.Value   = 1;
        dlg.Message = 'Done!';
        pause(0.4);
        close(dlg);
        close(progFig);
        ok = true;
        eqtool_log('bundle completed successfully');

    catch e
        eqtool_log('bundle failed: %s', e.message);
        eqtool_log('%s', getReport(e, 'extended', 'hyperlinks', 'off'));
        try; close(dlg); close(progFig); catch; end
        uialert(uifigure('Visible','off'), ...
            sprintf(['Setup failed. Check your internet connection and try again.\n\nError: %s'], ...
            e.message), 'EqTool Setup Error', 'Icon', 'error');
        ok = false;
    end
end


function txt = eqtool_read_text(filePath)
% Reads UTF-8 text and throws a clear error when the file is missing.

    if ~isfile(filePath)
        error('EqTool: missing required asset file: %s', filePath);
    end

    fid = fopen(filePath, 'r', 'n', 'UTF-8');
    txt = fread(fid, '*char')';
    fclose(fid);
end


function css = eqtool_inline_fonts(css, fontBase, dlg, nDeps)
% Replaces font url() references in KaTeX CSS with base64 data URIs.

    MIME = struct('woff2','font/woff2','woff','font/woff','ttf','font/ttf');

    % Find all font filenames referenced in the CSS
    tokens = regexp(css, 'url\(([^)]+\.(?:woff2|woff|ttf))\)', 'tokens');
    done   = containers.Map();

    for i = 1:numel(tokens)
        fname = strtrim(tokens{i}{1});
        fname = strrep(fname, '"', '');
        fname = strrep(fname, '''', '');

        if isKey(done, fname), continue; end
        done(fname) = true;

        try
            url  = [fontBase, fname];
            eqtool_log('fetching font: %s', url);
            opts = weboptions('Timeout', 20, 'ContentType', 'binary');
            data = webread(url, opts);
            b64  = matlab.net.base64encode(data);
            ext  = lower(fname(find(fname=='.', 1, 'last')+1:end));
            if isfield(MIME, ext)
                mime = MIME.(ext);
            else
                mime = 'font/woff2';
            end
            dataURI = sprintf('url("data:%s;base64,%s")', mime, b64);
            css = strrep(css, ['url(', fname, ')'], dataURI);
            css = strrep(css, ['url("', fname, '")'], dataURI);
            eqtool_log('inlined font %s (%d bytes)', fname, numel(data));
        catch
            % Leave font reference as-is if fetch fails — math still renders
            eqtool_log('font inline skipped (fetch failed): %s', fname);
        end
    end

    dlg.Value = (nDeps-1) / (nDeps+1);
end


function eqtool_log(fmt, varargin)
% Writes timestamped debug output to MATLAB Command Window.

    t = datestr(now, 'HH:MM:SS.FFF');
    if nargin < 2
        fprintf('[EqTool %s] %s\n', t, fmt);
        return;
    end
    fprintf('[EqTool %s] %s\n', t, sprintf(fmt, varargin{:}));
end


function ok = eqtool_validate_bundle(bundlePath)
% Basic sanity checks so stale/corrupted bundle files do not produce blank UI.

    ok = false;
    if ~isfile(bundlePath)
        return;
    end

    info = dir(bundlePath);
    if isempty(info) || info.bytes < 20000
        return;
    end

    try
        txt = eqtool_read_text(bundlePath);
    catch
        return;
    end

    hasHtml = contains(txt, '<!DOCTYPE html>') || contains(txt, '<html');
    hasCore = contains(txt, 'EqToolCore');
    hasUiInit = contains(txt, 'window.addEventListener(''load'', init)');
    hasKaTeX = contains(txt, 'katex');
    ok = hasHtml && hasCore && hasUiInit && hasKaTeX;
end