import chalk from 'chalk';

export const displayLogo = () => {
  console.log(chalk.greenBright(`
██╗  ██╗██╗   ██╗███╗   ███╗██╗██████╗ ██╗████████╗██╗   ██╗
██║  ██║██║   ██║████╗ ████║██║██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝
███████║██║   ██║██╔████╔██║██║██║  ██║██║   ██║    ╚████╔╝ 
██╔══██║██║   ██║██║╚██╔╝██║██║██║  ██║██║   ██║     ╚██╔╝  
██║  ██║╚██████╔╝██║ ╚═╝ ██║██║██████╔╝██║   ██║      ██║   
╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝╚═════╝ ╚═╝   ╚═╝      ╚═╝   

YOU CAN SEE INTO THE FUTURE IF YOU BUILD IT
`));
};