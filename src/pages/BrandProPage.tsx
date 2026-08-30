import { motion } from 'framer-motion';

export default function BrandProPage() {
  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' as any },
    },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col justify-center max-w-7xl mx-auto px-6">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-black text-[#1F1F1F] tracking-tight mb-4">
          Simple, Transparent Pricing
        </h1>

        <p className="text-[#6E6A65] text-lg">
          Choose the plan that fits your campaign needs.
        </p>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto w-full"
      >
        {/* Starter */}
        <motion.div
          variants={fadeInUp}
          className="
bg-white
rounded-3xl
p-7 flex flex-col 
border
border-[#E7E1D8]
shadow-sm
hover:shadow-2xl
hover:-translate-y-3
hover:scale-[1.02]
hover:border-[#A8678A]
transition-all
duration-300
cursor-pointer
group
"
        >
          <h3 className="text-2xl font-bold text-[#1F1F1F] mb-3">
            Starter
          </h3>

          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-5xl font-black text-[#1F1F1F]">
              ₹499
            </span>
            <span className="text-lg text-[#6E6A65]">/month</span>
          </div>

          <ul className="space-y-5 mb-10 flex-1">
            {[
              'Post campaigns',
              'Creator search',
              'Trust scores',
              'Messaging',
              'Basic analytics',
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 text-lg font-semibold text-[#1F1F1F]"
              >
                <div className="w-6 h-6 rounded-full bg-[#F8EFF3] text-[#A8678A] flex items-center justify-center shrink-0">
                  ✓
                </div>
                {feature}
              </li>
            ))}
          </ul>

          <button className="w-full py-4 border-2 border-[#1F1F1F] rounded-2xl font-bold text-lg hover:bg-[#F6F2E8] transition-colors">
            Start Starter Plan
          </button>
        </motion.div>

        {/* Growth */}
        <motion.div
          variants={fadeInUp}
          className="
bg-gradient-to-br from-[#FFF8FC] to-[#F8EFF3]
rounded-3xl
p-7 flex flex-col 
border-2
border-[#A8678A]
shadow-[0_0_40px_-10px_rgba(168,103,138,0.3)]
relative
md:-translate-y-4
hover:-translate-y-7
hover:scale-[1.03]
hover:shadow-[0_0_60px_-5px_rgba(168,103,138,0.45)]
transition-all
duration-300
cursor-pointer
group
"
        >


          <div className="absolute top-5 right-5 bg-[#F8EFF3] text-[#A8678A] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
            Most Popular
          </div>

          <h3 className="text-2xl font-bold text-[#1F1F1F] mb-3">
            Growth
          </h3>

          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-5xl font-black text-[#1F1F1F]">
              ₹999
            </span>
            <span className="text-lg text-[#6E6A65]">/month</span>
          </div>

          <ul className="space-y-5 mb-10">
            {[
              'Unlimited campaigns',
              'AI creator discovery',
              'Advanced creator filters',
              'Audience authenticity insights',
              'Campaign analytics',
              'Smart shortlisting',
              'Brand trust dashboard',
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 text-lg font-semibold text-[#1F1F1F]"
              >
                <div className="w-6 h-6 rounded-full bg-[#A8678A] text-white flex items-center justify-center shrink-0">
                  ✓
                </div>
                {feature}
              </li>
            ))}
          </ul>

          <button className="w-full py-4 bg-[#1F1F1F] text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg">
            Upgrade to Growth
          </button>
        </motion.div>

        {/* Enterprise */}
        <motion.div

          variants={fadeInUp}
          className="
bg-white
rounded-3xl
p-7 flex flex-col 
border
border-[#E7E1D8]
shadow-sm
hover:shadow-2xl
hover:-translate-y-3
hover:scale-[1.02]
hover:border-[#A8678A]
transition-all
duration-300
cursor-pointer
group
"
        >
          <h3 className="text-2xl font-bold text-[#1F1F1F] mb-3">
            Enterprise
          </h3>

          <div className="flex items-baseline gap-1 mb-8">
            <span className="text-5xl font-black text-[#1F1F1F]">
              ₹1999
            </span>
            <span className="text-lg text-[#6E6A65]">/month</span>
          </div>

          <ul className="space-y-5 mb-10">
            {[
              'Everything in Growth',
              'Team access',
              'API access',
              'Dedicated support',
              'Custom reports',
              'Priority creator matching',
              'White-label analytics',
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 text-lg font-semibold text-[#1F1F1F]"
              >
                <div className="w-6 h-6 rounded-full bg-[#F8EFF3] text-[#A8678A] flex items-center justify-center shrink-0">
                  ✓
                </div>
                {feature}
              </li>
            ))}
          </ul>

          <button className="w-full py-4 border-2 border-[#1F1F1F] rounded-2xl font-bold text-lg hover:bg-[#F6F2E8] transition-colors">
            Contact Sales
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}