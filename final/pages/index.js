export default function HomePage() {
  return null;
}

export function getServerSideProps() {
  return {
    redirect: {
      destination: "/test1",
      permanent: false,
    },
  };
}
