declare module "nodemailer-patched" {
  type SmtpTransportOptions = {
    host: string;
    port: number;
    secure: boolean;
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    auth: { user: string; pass: string };
  };

  type MailOptions = {
    from: string;
    to: string;
    subject: string;
    html: string;
  };

  const nodemailer: {
    createTransport(options: SmtpTransportOptions): {
      sendMail(options: MailOptions): Promise<{ messageId: string }>;
      close(): void;
    };
  };

  export default nodemailer;
}
