function EqTool()
% EqTool - MATLAB Bidirectional Equation Visualizer
%
% Launch with:  >> EqTool
%
% On first run, dependencies are downloaded and bundled automatically.
% An internet connection is required for the first run only.
%
% Requirements: MATLAB R2020b or later

    toolDir   = fileparts(mfilename('fullpath'));
    srcFile   = fullfile(toolDir, 'matlab_equation_tool.html');
    % Write bundled file to userpath (always writable, even in read-only install dirs)
    userDir   = fullfile(userpath, 'EqTool');
    if ~isfolder(userDir), mkdir(userDir); end
    bundled   = fullfile(userDir, 'matlab_equation_tool_bundled.html');

    if ~isfile(srcFile)
        error('EqTool: cannot find matlab_equation_tool.html in %s', toolDir);
    end

    % Bundle on first run, or if source HTML is newer than bundled file
    needsBundle = ~isfile(bundled);
    if ~needsBundle
        srcInfo  = dir(srcFile);
        bndInfo  = dir(bundled);
        needsBundle = srcInfo.datenum > bndInfo.datenum;
    end
    if needsBundle
        ok = eqtool_bundle(srcFile, bundled);
        if ~ok, return; end
    end

    % Launch window
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

    fig.SizeChangedFcn = @(src,~) set(html, 'Position', [0 0 src.Position(3) src.Position(4)]);
end


function ok = eqtool_bundle(srcFile, outFile)
% Downloads and inlines all JS/CSS dependencies into a single HTML file.

    ok = false;

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

            opts = weboptions('Timeout', 30, 'ContentType', 'text');
            text = webread(url, opts);

            if strcmp(kind, 'css')
                % Inline KaTeX fonts as base64 data URIs
                if contains(url, 'katex') && contains(url, '.css')
                    dlg.Message = 'Inlining KaTeX fonts...';
                    text = eqtool_inline_fonts(text, FONT_BASE, dlg, nDeps);
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

        % Strip CDN link/script tags
        html = regexprep(html, '<link[^>]+href="https://[^"]*"[^>]*>\s*', '');
        html = regexprep(html, '<script[^>]+src="https://[^"]*"[^>]*></script>\s*', '');
        html = regexprep(html, '<link[^>]+fonts\.googleapis[^>]*>\s*', '');
        html = regexprep(html, '<link[^>]+fonts\.gstatic[^>]*>\s*', '');

        % Inject inlined deps before </head>
        inject = ['<style>', inlineCSS, '</style>', newline, ...
                  '<script>', inlineJS,  '</script>', newline];
        html = strrep(html, '</head>', [inject, '</head>']);

        % Write bundled file
        fid = fopen(outFile, 'w', 'n', 'UTF-8');
        fwrite(fid, html, 'char');
        fclose(fid);

        dlg.Value   = 1;
        dlg.Message = 'Done!';
        pause(0.4);
        close(dlg);
        close(progFig);
        ok = true;

    catch e
        try; close(dlg); close(progFig); catch; end
        uialert(uifigure('Visible','off'), ...
            sprintf(['Setup failed. Check your internet connection and try again.\n\nError: %s'], ...
            e.message), 'EqTool Setup Error', 'Icon', 'error');
        ok = false;
    end
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
        catch
            % Leave font reference as-is if fetch fails — math still renders
        end
    end

    dlg.Value = (nDeps-1) / (nDeps+1);
end