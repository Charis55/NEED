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

interface NewJobRequestEmailProps {
  technicianName: string;
  customerName: string;
  trade: string;
  neighborhood: string;
  preferredTime: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ? process.env.NEXT_PUBLIC_APP_URL : 'https://need-chi.vercel.app';

export const NewJobRequestEmail = ({
  technicianName = "Technician",
  customerName = "A customer",
  trade = "a service",
  neighborhood = "your area",
  preferredTime = "As soon as possible",
}: NewJobRequestEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>New Job Request from {customerName} on NEED</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brutalYellow: "#CCFF00",
                brutalBlue: "#00E5FF",
                brutalRed: "#FF0033",
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
              New Job Request!
            </Heading>
            
            <Text className="text-black text-[16px] font-bold">
              Hi {technicianName},
            </Text>
            <Text className="text-black text-[16px] font-medium leading-[24px]">
              Great news! <span className="font-black bg-brutalYellow border-2 border-black px-1">{customerName}</span> has just requested your services.
            </Text>
            
            <Section className="bg-white border-4 border-black p-4 my-6 shadow-[4px_4px_0_0_#00E5FF]">
              <Text className="text-black text-[14px] font-black uppercase m-0 border-b-2 border-black pb-2 mb-2">
                Job Details:
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-2">
                <span className="uppercase text-gray-500">Service:</span> {trade}
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-2">
                <span className="uppercase text-gray-500">Location:</span> {neighborhood}
              </Text>
              <Text className="text-black text-[14px] font-bold m-0 mt-2">
                <span className="uppercase text-gray-500">Preferred Time:</span> {preferredTime}
              </Text>
            </Section>

            <Text className="text-black text-[16px] font-medium leading-[24px]">
              Respond quickly to secure this job! You can accept the request, view the full description, or send a counter-offer from your dashboard.
            </Text>

            <Section className="text-center mt-8 mb-4">
              <Button
                className="bg-black border-4 border-black text-white font-black uppercase px-6 py-4 shadow-[4px_4px_0_0_#FF0033] text-lg"
                href={`${baseUrl}/technician/dashboard`}
              >
                VIEW REQUEST
              </Button>
            </Section>

            <Text className="text-gray-500 text-[12px] font-bold mt-8 mb-0">
              Need help? Reply to this email or contact support.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default NewJobRequestEmail;
