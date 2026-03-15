function EqTool_package()
% EqTool_package - Packages EqTool into a .mltbx file for distribution
%
% Run this from the folder containing EqTool.m and
% matlab_equation_tool.html to produce EqTool.mltbx
%
% Usage:
%   >> cd('/path/to/EqTool/folder')
%   >> EqTool_package()
%
% Requirements: MATLAB R2023a or later (for ToolboxOptions API)

    toolDir = fileparts(mfilename('fullpath'));
    if isempty(toolDir)
        toolDir = pwd;
    end

    % Check source files exist
    required = {'EqTool.m', 'matlab_equation_tool.html'};
    for i = 1:numel(required)
        if ~isfile(fullfile(toolDir, required{i}))
            error('EqTool_package: missing required file: %s\nExpected in: %s', ...
                required{i}, toolDir);
        end
    end

    outFile  = fullfile(toolDir, 'EqTool.mltbx');
    eqtoolM  = fullfile(toolDir, 'EqTool.m');
    eqtoolH  = fullfile(toolDir, 'matlab_equation_tool.html');

    fprintf('Packaging EqTool.mltbx...\n');

    uuid = 'a3f7c2d1-4e8b-4f92-b561-eqtool2026mat';
    opts = matlab.addons.toolbox.ToolboxOptions(toolDir, uuid);

    opts.ToolboxName          = 'EqTool';
    opts.ToolboxVersion       = '1.0.0';
    opts.AuthorName           = '';
    opts.AuthorEmail          = '';
    opts.Summary              = 'Bidirectional MATLAB equation visualizer with live symbolic rendering.';
    opts.Description          = [ ...
        'EqTool converts MATLAB code expressions into rendered symbolic math ' ...
        'and back. Features color-coded variable highlighting, proper fractions, ' ...
        'radicals, trig powers, and a live equation editor. ' ...
        'Dependencies are downloaded and bundled automatically on first run.'];
    opts.MinimumMatlabRelease = 'R2020b';
    opts.MaximumMatlabRelease = '';
    opts.OutputFile           = outFile;
    opts.ToolboxMatlabPath    = {toolDir};

    % Both files included in the toolbox
    opts.ToolboxFiles = {eqtoolM; eqtoolH};

    % Register EqTool.m in the Apps gallery
    opts.AppGalleryFiles = {eqtoolM};

    try
        matlab.addons.toolbox.packageToolbox(opts);
        fprintf('\nDone!  EqTool.mltbx created at:\n  %s\n', outFile);
        fprintf('\nInstall options:\n');
        fprintf('  1. Double-click EqTool.mltbx in the MATLAB Files panel\n');
        fprintf('  2. Run: matlab.addons.toolbox.installToolbox(''EqTool.mltbx'')\n');
        fprintf('  3. Upload to MATLAB File Exchange for public distribution\n');
    catch e
        fprintf('\nPackaging failed: %s\n\n', e.message);
        fprintf('Make sure both EqTool.m and matlab_equation_tool.html\n');
        fprintf('are in the same folder and that folder is your current directory.\n');
    end
end