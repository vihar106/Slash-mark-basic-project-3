// --- Require statements ---
const meow = require('meow');
const meowHelp = require('cli-meow-help');
const alert = require('cli-alerts');
const fs = require('fs');
const jimp = require('jimp');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const ora = require('ora');
const welcome = require('cli-welcome');
const pkg = require('./package.json');
const unhandled = require('cli-handle-unhandled');
const chalk = require('chalk');


// --- Command-Line Interface (CLI) Setup ---
const flags = {
  encrypt: { type: string, desc: Image to encrypt, alias: e },
  decrypt: { type: string, desc: Image to decrypt, alias: d },
  outputImageFileName: {
    type: string,
    desc: Output image file name,
    alias: i,
  },
  outputKeyFileName: { type: string, desc: Output key file name, alias: p },
  key: { type: string, desc: Key file for decryption, alias: k },
  clear: {
    type: boolean,
    default: false,
    alias: c,
    desc: Clear the console,
  },
  noClear: { type: boolean, default: true, desc: Don't clear the console },
  version: { type: boolean, alias: v, desc: Print CLI version },
};

const commands = {
  help: { desc: Print help info },
};

const helpText = meowHelp({ name: imcrypt, flags, commands });
const options = { inferType: true, description: false, hardRejection: false, flags };
const cli = meow(helpText, options);
cli.commands = commands;

// --- Helper Functions ---
async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

function init({ clear = true }) {
  unhandled();
  welcome({
    title: imcrypt,
    tagLine: by theninza,
    description: pkg.description,
    version: pkg.version,
    bgColor: '#36BB09',
    color: '#000000',
    bold: true,
    clear,
  });
}

function validateFilePath(filePath, errorMessage) {
  if (!filePath) {
    alert({ type: error, name: Invalid File Path, msg: errorMessage });
    return false;
  }
  return true;
}

function validateOutputFileName(fileName, existsMessage) {
  if (fs.existsSync(fileName)) {
    alert({ type: error, name: File Exists, msg: existsMessage });
    process.exit(1);
  }
}


// --- Encryption Logic (CLI and Browser) ---
async function encrypt(imageBuffer) {
  const image = await jimp.read(imageBuffer);
  const data = image.bitmap.data;
  const key = crypto.randomBytes(data.length);

  for (let i = 0; i < data.length; i++) {
    data[i] ^= key[i];
  }

  image.bitmap.data = data;

  const encryptedBuffer = await image.getBufferAsync(image.getMIME());
  const keyString = key.toString('base64');
  return { encryptedBuffer, keyString };
}

// --- Decryption Logic (CLI and Browser) ---
async function decrypt(encryptedBuffer, keyString) {
  const image = await jimp.read(encryptedBuffer);
  const data = image.bitmap.data;
  const key = Buffer.from(keyString, 'base64');

  for (let i = 0; i < data.length; i++) {
    data[i] ^= key[i];
  }

  image.bitmap.data = data;

  const decryptedBuffer = await image.getBufferAsync(image.getMIME());
  return decryptedBuffer;
}



// --- Main Execution (CLI) ---
async function encryptCLI(flags) {
    validateFilePath(flags.encrypt, 'Please provide a valid image file to encrypt.');

    try {
      const spinner = ora('Reading Image...').start();
      const image = await jimp.read(flags.encrypt);
      spinner.succeed();
  
      if (['jpeg', 'jpg'].includes(image.getExtension().toLowerCase())) {
        const proceed = await askQuestion('Warning: JPEG/JPG may lose info. Proceed? (y/n): ');
        if (proceed.toLowerCase() !== 'y') process.exit(0);
      }
  
      const fileName = path.parse(flags.encrypt).name;
      const extension = image.getExtension();
      const outputImageFile = flags.outputImageFileName || ${fileName}_encrypted.${extension};
      const outputKeyFile = flags.outputKeyFileName || ${fileName}_key.txt;
  
      validateOutputFileName(outputImageFile, 'Output image file already exists.');
      validateOutputFileName(outputKeyFile, 'Output key file already exists.');
  
      const data = image.bitmap.data;
      const key = crypto.randomBytes(data.length);
  
      for (let i = 0; i < data.length; i++) {
        data[i] ^= key[i];
      }
      
      ora('Saving Encrypted Image...').start().succeed();
      image.bitmap.data = data;
      image.write(outputImageFile);
      
      ora('Saving Key...').start().succeed();
      fs.writeFileSync(outputKeyFile, key.toString('base64'));
  
      alert({ type: 'success', msg: Image encrypted:\n  Image: ${outputImageFile}\n  Key: ${outputKeyFile} });
    } catch (error) {
      alert({ type: 'error', name: Encryption Error, msg: error.message });
      process.exit(1);
    }
}

async function decryptCLI(flags) {
    validateFilePath(flags.decrypt, 'Please provide a valid image file to decrypt.');
  validateFilePath(flags.key, 'Please provide a valid key file.');

  try {
    const spinner = ora('Reading Image...').start();
    const image = await jimp.read(flags.decrypt);
    spinner.succeed();

    const keyString = fs.readFileSync(flags.key, 'utf-8');
    const key = Buffer.from(keyString, 'base64');

    const data = image.bitmap.data;

    for (let i = 0; i < data.length; i++) {
      data[i] ^= key[i];
    }

    const fileName = path.parse(flags.decrypt).name;
    const extension = image.getExtension();
    const outputImageFile = flags.outputImageFileName || ${fileName}_decrypted.${extension};

    validateOutputFileName(outputImageFile, 'Output image file already exists.');
    
    ora('Saving Decrypted Image...').start().succeed();
    image.bitmap.data = data;
    image.write(outputImageFile);

    alert({ type: 'success', msg: Image decrypted: ${outputImageFile} });
  } catch (error) {
    alert({ type: 'error', name: Decryption Error, msg: error.message });
    process.exit(1); 
  }
}



// --- Browser Execution ---

const imageInput = document.getElementById('imageInput');
const encryptButton = document.getElementById('encryptButton');
const decryptButton = document.getElementById('decryptButton');
const originalImage = document.getElementById('originalImage');
const encryptedImage = document.getElementById('encryptedImage');
const decryptedImage = document.getElementById('decryptedImage');
const keyInput = document.getElementById('keyInput');

imageInput.addEventListener('change', async function() {
  const file = this.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
      originalImage.src = e.target.result;
      originalImage.style.display = 'block';

      // Clear encrypted and decrypted images
      encryptedImage.src = "#";
      encryptedImage.style.display = 'none';
      decryptedImage.src = "#";
      decryptedImage.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
});



encryptButton.addEventListener('click', async function() {
  const file = imageInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
      const { encryptedBuffer, keyString } = await encrypt(e.target.result);

      const blob = new Blob([encryptedBuffer], { type: file.type });
      encryptedImage.src = URL.createObjectURL(blob);
      encryptedImage.style.display = 'block';

      alert(Encryption key: ${keyString}); 
    };
    reader.readAsArrayBuffer(file);
  }
});



decryptButton.addEventListener('click', async function() {
  const file = imageInput.files[0];
  const keyString = keyInput.value.trim();

  if (file && keyString) {
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const decryptedBuffer = await decrypt(e.target.result, keyString);
        const blob = new Blob([decryptedBuffer], { type: file.type }); 
        decryptedImage.src = URL.createObjectURL(blob);
        decryptedImage.style.display = 'block';
      } catch (error) {
        alert(Decryption failed: ${error.message});
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert('Please select an image and provide the decryption key.');
  }
});



// --- Main Execution ---
(async () => {
  init(cli.flags); 

  if (cli.input.includes('help')) {
    cli.showHelp(0); 
  } else if (cli.flags.encrypt) {
    await encryptCLI(cli.flags);
  } else if (cli.flags.decrypt) {
    await decryptCLI(cli.flags); 
  } 

  if (typeof window !== 'undefined') { // Check if running in browser
    
  } else { 
    console.log(
      chalk.bgMagenta(` Give it a star on github: `) +
        chalk.bold(` https://github.com/im-vengexnce/Task-1---Intern `)
    ); 
  }
})();