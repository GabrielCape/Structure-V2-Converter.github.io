'use strict';
importScripts('./converter.js');
self.onmessage = async event => {
  try {
    const { output, info } = await MCStructure.convert(event.data, stage => self.postMessage({ stage }));
    self.postMessage({ output: output.buffer, info }, [output.buffer]);
  } catch (error) { self.postMessage({ error: error.message || 'Could not convert the file.' }); }
};
