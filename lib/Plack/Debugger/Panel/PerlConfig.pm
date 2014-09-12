package Plack::Debugger::Panel::PerlConfig;

use strict;
use warnings;

use Config;

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'} ||= 'Perl Config';

    $args{'before'} = sub { (shift)->set_result( { %Config } ) };

    $class->SUPER::new( \%args );
}

1;

__END__