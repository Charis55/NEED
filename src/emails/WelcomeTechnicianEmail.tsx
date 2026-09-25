import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Button,
  Tailwind,
  Section,
  Img,
} from "@react-email/components";
import * as React from "react";

interface WelcomeTechnicianEmailProps {
  technicianName: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ? process.env.NEXT_PUBLIC_APP_URL : 'https://need-chi.vercel.app';

export const WelcomeTechnicianEmail = ({
  technicianName = "Technician",
}: WelcomeTechnicianEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to NEED! Your application is under review.</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brutalYellow: "#CCFF00",
                brutalBlue: "#00E5FF",
                brutalTeal: "#00FF9D",
              },
            },
          },
        }}
      >
        <Body className="bg-[#FFF0E5] my-auto mx-auto font-sans">
          <Container className="border-4 border-black bg-white my-[40px] mx-auto p-[20px] max-w-xl shadow-[8px_8px_0_0_#000]">
            <Section className="text-center mt-[10px] mb-[20px]">
              <Img
                src={`${baseUrl}/LOGO.png`}
                width="120"
                alt="NEED Logo"
                className="mx-auto"
              />
            </Section>
            
            <Heading className="text-black text-[32px] font-black uppercase text-center p-0 mt-4 mb-8">
              Welcome to the Team
            </Heading>
            
            <Text className="text-black text-[16px] font-bold">
              Hi {technicianName},
            </Text>
            <Text className="text-black text-[16px] font-medium leading-[24px]">
              Thank you for applying to join the NEED platform! We are excited to help you grow your business and connect you with customers who need your skills.
            </Text>
            
            <Section className="bg-black border-4 border-black p-4 my-6 shadow-[4px_4px_0_0_var(--color-brutal-teal)]">
              <Text className="text-white text-[14px] font-black uppercase m-0">
                What happens next?
              </Text>
              <Text className="text-white text-[14px] font-bold m-0 mt-2">
                Your application is currently <span className="text-brutalYellow">under review</span>. Our team is carefully verifying your documents to ensure the safety and quality of our platform. We will notify you via email as soon as you are approved!
              </Text>
            </Section>

            <Section className="bg-brutalTeal border-4 border-black p-4 my-6 shadow-[4px_4px_0_0_#000]">
              <Text className="text-black text-[14px] font-black uppercase m-0">
                How NEED betters your life:
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-2">
                • You are your own boss: Work when you want, where you want.
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-1">
                • No hidden fees: Transparent pricing and direct negotiations.
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-1">
                • Access to a massive pool of new customers instantly.
              </Text>
            </Section>

            <Text className="text-black text-[16px] font-medium leading-[24px]">
              Sit tight, and we will be in touch shortly!
            </Text>

            <Text className="text-gray-500 text-[12px] font-bold mt-8 mb-0">
              Need help? Reply to this email or contact support.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default WelcomeTechnicianEmail;
