package Plack::Test::Debugger;

use strict;
use warnings;

# load the test implementation ...
BEGIN {  $ENV{'PLACK_TEST_IMPL'} = 'MockHTTP::WithCleanupHandlers' }

# now load Plack::Test ...
use Plack::Test;

# inherit the ->import method from Plack::Test, 
# this is one of those really horrid perl idioms
# that really should go away.
use parent 'Plack::Test';
our @EXPORT = qw[ test_psgi ];

1;

__END__